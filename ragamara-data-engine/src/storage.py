"""
Storage Module.
Handles atomic file writes, deterministic ID generation, checkpoint persistence, and JSON serialization.
"""

import hashlib
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings
from src.normalization import clean_matching_key

logger = logging.getLogger("ragamara.storage")


class StorageManager:
    """Manages database storage, atomic writes, and pipeline checkpoints."""

    def __init__(self, output_path: Path = settings.OUTPUT_FILE):
        self.output_path = output_path
        self.checkpoint_path = settings.CACHE_DIR / "pipeline_checkpoint.json"

    @staticmethod
    def generate_record_id(official_id: Optional[str], entity_type: str, normalized_name: str, province: Optional[str]) -> str:
        """
        Generates a deterministic, collision-resistant record ID.
        Uses DAPOBUD's official ID if present, otherwise creates a stable hash.
        """
        if official_id and len(official_id.strip()) > 0:
            clean_id = official_id.strip().replace(" ", "_")
            return f"id_dapobud_{clean_id}"

        # Fallback hash
        payload = f"{entity_type.lower()}:{clean_matching_key(normalized_name)}:{(province or '').lower().strip()}"
        hash_digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
        return f"id_hash_{hash_digest}"

    def atomic_write_json(self, data: Dict[str, Any], target_path: Optional[Path] = None) -> None:
        """Writes JSON to disk atomically using a temp file and atomic rename."""
        dest = target_path or self.output_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp_file = dest.with_suffix(".tmp")

        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())

            # Atomic replace
            os.replace(temp_file, dest)
            logger.info(f"Successfully saved atomic JSON to {dest}")
        except Exception as e:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass
            logger.error(f"Failed atomic write to {dest}: {e}")
            raise

    def load_database(self, source_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
        """Loads existing cultural database if present."""
        path = source_path or self.output_path
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load existing database from {path}: {e}")
            return None

    def save_checkpoint(self, state: Dict[str, Any]) -> None:
        """Saves pipeline state to checkpoint file."""
        try:
            with open(self.checkpoint_path, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            logger.debug("Checkpoint saved successfully.")
        except Exception as e:
            logger.warning(f"Failed to save checkpoint: {e}")

    def load_checkpoint(self) -> Optional[Dict[str, Any]]:
        """Loads existing pipeline checkpoint if available."""
        if not self.checkpoint_path.exists():
            return None
        try:
            with open(self.checkpoint_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read checkpoint: {e}")
            return None

    def clear_checkpoint(self) -> None:
        """Removes the checkpoint file once a pipeline run finishes."""
        if self.checkpoint_path.exists():
            try:
                self.checkpoint_path.unlink()
            except Exception as e:
                logger.warning(f"Error removing checkpoint: {e}")
