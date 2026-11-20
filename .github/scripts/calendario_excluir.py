"""Apaga do site os calendarios excluidos pela pagina /calendario/.

A pagina grava o slug do cliente em sistema/calendario_excluidos (Firestore).
Este script remove a pasta calendario/<slug>/ e tira o cliente da lista
calendario/index.html. Roda pelo GitHub Actions (calendario-excluir.yml).
"""
import json, os, re, shutil, sys, urllib.request, urllib.error

URL = ("https://firestore.googleapis.com/v1/projects/i9fit-4b643/databases/(default)"
       "/documents/sistema/calendario_excluidos?key=AIzaSyC6xUfFJ59fXT1_eR1HDD7UPiQ8aakSkHY")
RAIZ = os.path.join(os.path.dirname(__file__), "..", "..")
PASTA = os.path.normpath(os.path.join(RAIZ, "calendario"))
SLUG_OK = re.compile(r"^[a-z0-9][a-z0-9-]*$")

def excluidos():
    try:
        with urllib.request.urlopen(URL, timeout=30) as r:
            doc = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise
    vals = doc.get("fields", {}).get("slugs", {}).get("arrayValue", {}).get("values", [])
    return [v.get("stringValue", "") for v in vals if SLUG_OK.match(v.get("stringValue", ""))]

def main():
    slugs = excluidos()
    print("Excluidos no Firestore:", slugs or "nenhum")
    mudou = False
    for slug in slugs:
        alvo = os.path.join(PASTA, slug)
        if os.path.isdir(alvo):
            shutil.rmtree(alvo)
            print("Pasta apagada:", "calendario/" + slug)
            mudou = True
    indice = os.path.join(PASTA, "index.html")
    if slugs and os.path.exists(indice):
        html = open(indice, encoding="utf-8").read()
        m = re.search(r"(var CLIENTES = )(\[.*?\])(;\n)", html)
        if m:
            lista = json.loads(m.group(2))
            nova = [c for c in lista if c.get("slug") not in slugs]
            if len(nova) != len(lista):
                txt = json.dumps(nova, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
                html = html[:m.start(2)] + txt + html[m.end(2):]
                open(indice, "w", encoding="utf-8").write(html)
                print("Lista atualizada:", len(lista), "->", len(nova), "clientes")
                mudou = True
    print("Alteracoes:", "sim" if mudou else "nao")

if __name__ == "__main__":
    sys.exit(main())
