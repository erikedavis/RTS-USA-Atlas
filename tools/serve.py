#!/usr/bin/env python3
"""Serve USAtlas on the PC, or opt in to a separate phone preview."""
from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from ipaddress import IPv4Address, ip_network
from pathlib import Path
from socket import AF_INET, getaddrinfo, gethostname
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen
import re
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
VERSION = re.search(r'<meta name="atlas-version" content="([^"]+)">',
                    (ROOT / 'index.html').read_text(encoding='utf-8'))[1]
PRIVATE_NETWORKS = tuple(map(ip_network, ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')))


def private_address(value):
    try:
        address = IPv4Address(value)
    except ValueError:
        return False
    return any(address in network for network in PRIVATE_NETWORKS)


def choose_address():
    candidates = sorted({entry[4][0] for entry in getaddrinfo(gethostname(), None, AF_INET)
                         if private_address(entry[4][0])})
    hint = ' (' + ', '.join(candidates) + ')' if candidates else ' (see ipconfig)'
    if len(candidates) == 1:
        return candidates[0]
    return input('Enter the IPv4 address of the PC on your trusted Wi-Fi' + hint + ': ').strip()


class AtlasFiles(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        parts = path.split('/')
        if path not in ('/', '/index.html'):
            allowed = len(parts) > 2 and parts[1] in ('assets', 'data', 'js')
            if not allowed or any(part in ('..', '.') for part in parts):
                self.send_error(404)
                return None
            target = (ROOT / path.lstrip('/')).resolve()
            if (ROOT / parts[1]) not in target.parents or not target.is_file():
                self.send_error(404)
                return None
        return super().send_head()


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--phone', nargs='?', const='', metavar='WIFI_IP',
                        help='Serve a phone preview on the specified private Wi-Fi address')
    parser.add_argument('--port', type=int, help='Override the default port')
    parser.add_argument('--no-browser', action='store_true', help='Do not open a PC browser')
    args = parser.parse_args()
    phone = args.phone is not None
    host = '127.0.0.1'
    if phone:
        host = args.phone or choose_address()
        if not private_address(host):
            parser.error('Choose a private IPv4 address on this PC.')
    port = args.port or (8019 if phone else 8020)
    url = f'http://{host}:{port}/'
    if not phone:
        try:
            with urlopen(url, timeout=1) as response:
                running_atlas = VERSION.encode() in response.read()
        except OSError:
            running_atlas = False
        if running_atlas:
            if not args.no_browser:
                webbrowser.open(url)
            return

    ThreadingHTTPServer.allow_reuse_address = False
    try:
        server = ThreadingHTTPServer((host, port), AtlasFiles)
    except OSError as error:
        parser.exit(1, f'Could not open {url}. Check the address or close the Atlas already using this port. ({error})\n')
    with server:
        print(f'USAtlas {VERSION}: {url}', flush=True)
        if phone:
            print('Open that address in Safari on an iPhone on the same trusted Wi-Fi.', flush=True)
        elif not args.no_browser:
            webbrowser.open(url)
        print('Keep this window open. Ctrl+C stops the server.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
