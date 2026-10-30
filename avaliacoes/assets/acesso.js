// Acesso restrito (mesma senha do administrador da plataforma i9Treino).
const SENHA = "admin123";
const CHAVE = "i9-admin-ok";

function lembrado() {
  try { return sessionStorage.getItem(CHAVE) === "1"; } catch (e) { return false; }
}
function lembrar() {
  try { sessionStorage.setItem(CHAVE, "1"); } catch (e) { /* sem storage */ }
}
export function sair() {
  try { sessionStorage.removeItem(CHAVE); } catch (e) { /* sem storage */ }
  location.reload();
}

/** Mostra a tela de senha e resolve quando o acesso for liberado. */
export function exigirAcesso(titulo = "Área restrita") {
  if (lembrado()) return Promise.resolve();
  return new Promise(resolve => {
    const tela = document.createElement("div");
    tela.className = "gate";
    tela.innerHTML = `
      <form class="gate-card" autocomplete="off">
        <a class="logo" href="/">i9<span>Treino</span></a>
        <h1>${titulo}</h1>
        <p>Digite a senha de administrador para continuar.</p>
        <input type="password" class="inp" placeholder="Senha" aria-label="Senha" autofocus>
        <button class="btn btn-primary" type="submit">Entrar</button>
        <small class="gate-erro" role="alert"></small>
      </form>`;
    document.body.appendChild(tela);
    const form = tela.querySelector("form");
    const inp = tela.querySelector("input");
    setTimeout(() => inp.focus(), 50);
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      if (inp.value === SENHA) {
        lembrar();
        tela.remove();
        resolve();
      } else {
        tela.querySelector(".gate-erro").textContent = "Senha incorreta.";
        inp.value = "";
        inp.focus();
      }
    });
  });
}
