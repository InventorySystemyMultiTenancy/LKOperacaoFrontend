// Login aberto (temporário, enquanto o backend não está no ar):
// ao clicar em "Entrar" entra direto como ADMIN, sem verificar e-mail/senha,
// e as chamadas à API falham na hora em vez de esperar o backend responder.
// Mude para false quando o backend e o banco estiverem publicados.
export const LOGIN_ABERTO = true;
