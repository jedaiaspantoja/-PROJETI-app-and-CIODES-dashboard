const SUPABASE_URL = "https://fcjettvlsmoxnzolqmkc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_gcvNapfPrLZVI2x49C8stQ_wwXo3HDb";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("Supabase nao carregado.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);

const loginForm = document.getElementById("loginForm");
const erroEl = document.getElementById("loginErro");
const forgotPassword = document.getElementById("forgot-password");

function setError(message) {
  if (!erroEl) return;
  erroEl.textContent = message;
  erroEl.classList.remove("hidden");
}

function clearError() {
  erroEl?.classList.add("hidden");
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const email = document.getElementById("email")?.value.trim();
  const senha = document.getElementById("senha")?.value;
  const btn = event.currentTarget.querySelector('button[type="submit"]');

  if (!email || !senha) {
    setError("Informe e-mail e senha para continuar.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Entrando...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: senha,
  });

  btn.disabled = false;
  btn.textContent = "Entrar";

  if (error) {
    setError("E-mail ou senha incorretos. Tente novamente.");
    return;
  }

  window.location.href = "index.html";
});

forgotPassword?.addEventListener("click", async (event) => {
  event.preventDefault();
  clearError();
  const email = document.getElementById("email")?.value.trim();
  if (!email) {
    setError("Informe seu e-mail para receber a recuperação de senha.");
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });

  setError(
    error
      ? "Não foi possível solicitar a recuperação agora."
      : "Se o e-mail existir, enviaremos as instruções de recuperação.",
  );
});

(async function redirectAuthenticatedUser() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session) window.location.href = "index.html";
})();
