"""Download official portable Android build tools into the ignored mobile/.tools folder."""
import concurrent.futures
import hashlib
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT / '.tools'
PACKAGES = {
    'jdk21': ('https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip', None),
    'commandline': ('https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip', '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'),
    'gradle814': ('https://services.gradle.org/distributions/gradle-8.14.3-bin.zip', None),
}

def install(item):
    name, (url, checksum) = item
    target = TOOLS / name
    if target.is_dir():
        return name + ' already present'
    TOOLS.mkdir(parents=True, exist_ok=True)
    archive = TOOLS / (name + '.zip')
    if not archive.exists():
        urllib.request.urlretrieve(url, archive)
    if checksum and hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
        raise RuntimeError(name + ' checksum mismatch')
    if name.startswith('gradle'):
        expected = urllib.request.urlopen(url + '.sha256').read().decode().strip().split()[0]
        if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
            raise RuntimeError('Gradle checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        z.extractall(target)
    return name + ' installed'

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(3) as pool:
        for message in pool.map(install, PACKAGES.items()):
            print(message, flush=True)
