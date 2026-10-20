"""Fetch immutable, checksum-verified llama.cpp source. No model is bundled."""
import hashlib
import json
from pathlib import Path
import tarfile
import httpx

ROOT = Path(__file__).resolve().parents[1]

def prepare():
    config = json.loads((ROOT / 'mobile/offline-ai.json').read_text(encoding='utf-8'))
    tools = ROOT / 'mobile/.tools'
    source = tools / ('llama.cpp-' + config['engine_commit'])
    if not (source / 'include/llama.h').is_file():
        tools.mkdir(parents=True, exist_ok=True)
        archive = tools / 'llama-source.tar.gz'
        with httpx.stream('GET', 'https://codeload.github.com/ggml-org/llama.cpp/tar.gz/' + config['engine_commit'], follow_redirects=True, timeout=180) as response:
            response.raise_for_status()
            with archive.open('wb') as f:
                for chunk in response.iter_bytes(): f.write(chunk)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != config['engine_archive_sha256']:
            raise RuntimeError('Inference source checksum mismatch.')
        with tarfile.open(archive) as t: t.extractall(tools, filter='data')
    return source

if __name__ == '__main__':
    print(prepare())
