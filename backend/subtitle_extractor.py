"""
字幕提取模块 - SubtitleExtractor
yt-dlp 提取字幕（YouTube 等） + B站 dm/view API（无需签名）
优先级：人工字幕 > 自动字幕 > 返回"该视频无字幕"
"""

import os
import re
import json
import logging
import tempfile
from pathlib import Path

import httpx
from yt_dlp import YoutubeDL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUBTITLE_LANGS = ["zh-Hans", "zh", "zh-CN", "en", "ja", "ko"]
SUBTITLE_FORMAT = "json3/srv3/vtt"


# ────────────────── B站直接 API 提取字幕 ──────────────────

def _bilibili_extract(url: str) -> dict | None:
    """通过 B站 dm/view API 提取 CC 字幕和 AI 字幕（无需 WBI 签名）。"""
    m = re.search(r"(BV[a-zA-Z0-9]+)", url)
    if not m:
        return None
    bvid = m.group(1)
    logger.info(f"[Bilibili API] bvid={bvid}")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": f"https://www.bilibili.com/video/{bvid}",
    }

    try:
        # 1. 获取 aid 和 cid
        view_resp = httpx.get(
            f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}",
            headers=headers, timeout=15,
        )
        view_data = view_resp.json().get("data", {})
        aid = view_data.get("aid")
        cid = view_data.get("cid")
        if not aid or not cid:
            logger.warning("[Bilibili API] 无法获取 aid/cid")
            return None
        logger.info(f"[Bilibili API] aid={aid}, cid={cid}")

        # 2. 通过 dm/view API 获取字幕列表（无需 WBI 签名）
        dm_resp = httpx.get(
            f"https://api.bilibili.com/x/v2/dm/view?aid={aid}&oid={cid}&type=1",
            headers=headers, timeout=15,
        )
        dm_data = dm_resp.json().get("data", {})
        subtitle_list = dm_data.get("subtitle", {}).get("subtitles", [])
        logger.info(f"[Bilibili API] 字幕轨道: {[s.get('lan_doc', s.get('lan')) for s in subtitle_list]}")

        if not subtitle_list:
            return None

        # 3. 按语言优先级选择最佳字幕
        chosen = subtitle_list[0]
        for lang in SUBTITLE_LANGS:
            for s in subtitle_list:
                if s.get("lan") == lang:
                    chosen = s
                    break
            else:
                continue
            break

        sub_url = chosen.get("subtitle_url", "")
        if sub_url.startswith("//"):
            sub_url = "https:" + sub_url
        if sub_url.startswith("http://"):
            sub_url = "https://" + sub_url[7:]
        if not sub_url:
            logger.warning("[Bilibili API] 字幕 URL 为空")
            return None

        logger.info(f"[Bilibili API] 下载字幕: {chosen.get('lan_doc', chosen.get('lan'))} → {sub_url[:80]}...")

        # 4. 下载并解析字幕 JSON
        sub_resp = httpx.get(sub_url, headers=headers, timeout=15)
        sub_data = sub_resp.json()
        body = sub_data.get("body", [])

        segments = []
        for item in body:
            text = item.get("content", "").strip()
            if not text:
                continue
            segments.append({
                "start": round(float(item.get("from", 0)), 3),
                "end": round(float(item.get("to", 0)), 3),
                "text": text,
            })
        if not segments:
            return None

        full_text = " ".join(seg["text"] for seg in segments)
        lang = chosen.get("lan", "zh")
        sub_type = "auto" if lang.startswith("ai-") else "manual"
        logger.info(f"[Bilibili API] 成功: lang={lang}, type={sub_type}, segments={len(segments)}")
        return {
            "has_subtitle": True,
            "language": lang,
            "segments": segments,
            "full_text": full_text,
            "source": sub_type,
        }
    except Exception as e:
        logger.error(f"[Bilibili API] 异常: {e}")
        return None


# ────────────────── 主提取器 ──────────────────

class SubtitleExtractor:
    """从视频 URL 提取字幕文本。"""

    def extract(self, url: str) -> dict:
        """提取字幕，返回标准结构。"""
        empty = {"has_subtitle": False, "language": "", "segments": [], "full_text": "", "source": ""}

        logger.info(f"[SubtitleExtractor] URL: {url}")

        is_bili = "bilibili.com" in url or "b23.tv" in url

        # ── B站：优先用 dm/view API 直接提取 ──
        if is_bili:
            result = _bilibili_extract(url)
            if result:
                return result
            logger.info("[SubtitleExtractor] B站 API 未获取到字幕，尝试 yt-dlp ...")

        # ── 通用：yt-dlp ──
        return self._ytdlp_extract(url, empty)

    def _ytdlp_extract(self, url: str, empty: dict) -> dict:
        """用 yt-dlp 提取字幕。"""
        with tempfile.TemporaryDirectory() as tmpdir:
            outtmpl = os.path.join(tmpdir, "%(id)s")
            ydl_opts = {
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": SUBTITLE_LANGS,
                "subtitlesformat": SUBTITLE_FORMAT,
                "skip_download": True,
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "outtmpl": outtmpl,
                "socket_timeout": 30,
            }

            try:
                with YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
            except Exception as e:
                logger.error(f"[SubtitleExtractor] extract_info 失败: {e}")
                return empty

            manual_subs = info.get("subtitles") or {}
            auto_subs = info.get("automatic_captions") or {}
            logger.info(
                f"[SubtitleExtractor] 人工字幕: {list(manual_subs.keys())}, "
                f"自动字幕: {list(auto_subs.keys())}"
            )

            lang, entries, source = self._pick_best(manual_subs, auto_subs)
            if not entries:
                logger.info("[SubtitleExtractor] 该视频无字幕")
                return empty

            logger.info(f"[SubtitleExtractor] 选中: lang={lang}, source={source}")

            dl_opts = {
                **ydl_opts,
                "writesubtitles": source == "manual",
                "writeautomaticsub": source == "auto",
                "subtitleslangs": [lang],
            }
            try:
                with YoutubeDL(dl_opts) as ydl:
                    ydl.download([url])
            except Exception as e:
                logger.error(f"[SubtitleExtractor] 字幕下载失败: {e}")
                return empty

            segments = self._find_and_parse(tmpdir)
            if not segments:
                logger.warning("[SubtitleExtractor] 字幕文件下载成功但解析为空")
                return empty

            full_text = " ".join(seg["text"] for seg in segments)
            logger.info(f"[SubtitleExtractor] 成功: lang={lang}, segments={len(segments)}")
            return {
                "has_subtitle": True,
                "language": lang,
                "segments": segments,
                "full_text": full_text,
                "source": source,
            }

    # ────────────────── 选择最佳字幕 ──────────────────

    @staticmethod
    def _pick_best(manual_subs: dict, auto_subs: dict) -> tuple:
        """按语言优先级选出最佳字幕。返回 (lang, entries, source) 或 ("", [], "")。"""
        exclude = {"danmaku", "live_danmaku"}

        for lang in SUBTITLE_LANGS:
            if lang in manual_subs and lang not in exclude:
                return lang, manual_subs[lang], "manual"
        for lang in SUBTITLE_LANGS:
            if lang in auto_subs and lang not in exclude:
                return lang, auto_subs[lang], "auto"

        for lang, entries in manual_subs.items():
            if lang not in exclude:
                return lang, entries, "manual"
        for lang, entries in auto_subs.items():
            if lang not in exclude:
                return lang, entries, "auto"

        return "", [], ""

    def _find_and_parse(self, tmpdir: str) -> list:
        """在目录中查找字幕文件并解析。返回 segments 列表。"""
        sub_files = []
        for ext in (".json3", ".srv3", ".vtt", ".srt", ".json", ".ass"):
            for f in Path(tmpdir).rglob(f"*{ext}"):
                sub_files.append(f)

        for f in sub_files:
            logger.info(f"[SubtitleExtractor] 解析文件: {f.name}")
            try:
                content = f.read_text(encoding="utf-8")
            except Exception:
                continue
            segments = self._parse(content, f.suffix.lstrip("."))
            if segments:
                return segments

        return []

    # ────────────────── 解析器 ──────────────────

    def _parse(self, content: str, ext: str) -> list:
        """根据格式解析字幕内容。"""
        try:
            data = json.loads(content)
            if isinstance(data, dict):
                if "body" in data:
                    return self._parse_bilibili_json(data)
                if "events" in data:
                    return self._parse_json3(data)
        except (json.JSONDecodeError, ValueError):
            pass

        if ext == "vtt" or "WEBVTT" in content[:50]:
            segs = self._parse_vtt(content)
            if segs:
                return segs

        if ext == "srt" or re.search(r"\d+\s*\n\d{2}:\d{2}:\d{2}", content):
            segs = self._parse_srt(content)
            if segs:
                return segs

        for parser in [self._parse_vtt, self._parse_srt]:
            segs = parser(content)
            if segs:
                return segs

        return []

    @staticmethod
    def _parse_bilibili_json(data: dict) -> list:
        """解析 Bilibili JSON: {"body": [{"from":..., "to":..., "content":...}]}"""
        segments = []
        for item in data.get("body", []):
            text = item.get("content", "").strip()
            if not text:
                continue
            segments.append({
                "start": round(float(item.get("from", 0)), 3),
                "end": round(float(item.get("to", 0)), 3),
                "text": text,
            })
        return segments

    @staticmethod
    def _parse_json3(data: dict) -> list:
        """解析 YouTube json3: {"events": [{"tStartMs":..., "segs":[{"utf8":...}]}]}"""
        segments = []
        for event in data.get("events", []):
            start_ms = event.get("tStartMs", 0)
            dur_ms = event.get("dDurationMs", 0)
            text = "".join(s.get("utf8", "") for s in event.get("segs", [])).strip()
            if not text or text == "\n":
                continue
            segments.append({
                "start": round(start_ms / 1000, 3),
                "end": round((start_ms + dur_ms) / 1000, 3),
                "text": text,
            })
        return segments

    @staticmethod
    def _parse_vtt(content: str) -> list:
        """解析 WebVTT 格式。"""
        segments = []
        content = re.sub(r"^WEBVTT.*?\n\n", "", content, flags=re.DOTALL)
        content = re.sub(r"NOTE.*?\n\n", "", content, flags=re.DOTALL)
        pattern = (
            r"(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})"
            r"[^\n]*\n(.*?)(?=\n\n|\Z)"
        )
        seen = set()
        for start, end, text in re.findall(pattern, content, re.DOTALL):
            text = re.sub(r"<[^>]+>", "", text).strip().replace("\n", " ")
            if not text or text in seen:
                continue
            seen.add(text)
            segments.append({"start": _ts(start), "end": _ts(end), "text": text})
        return segments

    @staticmethod
    def _parse_srt(content: str) -> list:
        """解析 SRT 格式。"""
        segments = []
        pattern = (
            r"\d+\s*\n"
            r"(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})"
            r"\s*\n(.*?)(?=\n\n|\Z)"
        )
        seen = set()
        for start, end, text in re.findall(pattern, content, re.DOTALL):
            text = re.sub(r"<[^>]+>", "", text).strip().replace("\n", " ")
            if not text or text in seen:
                continue
            seen.add(text)
            segments.append({
                "start": _ts(start.replace(",", ".")),
                "end": _ts(end.replace(",", ".")),
                "text": text,
            })
        return segments


def _ts(time_str: str) -> float:
    """HH:MM:SS.mmm → 秒数"""
    h, m, s = time_str.split(":")
    return round(int(h) * 3600 + int(m) * 60 + float(s), 3)


# ────────────────── 向后兼容的函数式接口 ──────────────────

_extractor = SubtitleExtractor()


def extract_subtitle(url: str) -> dict:
    """函数式接口，供 ai_routes.py 调用。"""
    return _extractor.extract(url)
