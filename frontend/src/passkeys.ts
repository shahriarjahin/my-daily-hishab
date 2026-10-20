import { api, device, native } from "./api";
const decode = (s: string) =>
  Uint8Array.from(
    atob(
      s.replaceAll("-", "+").replaceAll("_", "/") +
        "=".repeat((4 - (s.length % 4)) % 4),
    ),
    (c) => c.charCodeAt(0),
  ).buffer;
const encode = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export async function usePasskey(registration = false) {
  if (native) {
    await device("passkey", { registration });
    return;
  }
  if (!window.isSecureContext || !window.PublicKeyCredential)
    throw new Error("Passkeys require a supported browser and HTTPS.");
  const ceremony = registration ? "registration" : "authentication";
  const start = await api<{
    challenge_id: string;
    options: Record<string, unknown>;
  }>("/auth/passkey/" + ceremony + "/options", "POST", {});
  const options = {
    ...start.options,
    challenge: decode(start.options.challenge as string),
  };
  let credential: PublicKeyCredential | null;
  if (registration) {
    const source =
      start.options as unknown as PublicKeyCredentialCreationOptions;
    const parsed = {
      ...options,
      user: { ...source.user, id: decode(source.user.id as unknown as string) },
      excludeCredentials: source.excludeCredentials?.map((c) => ({
        ...c,
        id: decode(c.id as unknown as string),
      })),
    } as unknown as PublicKeyCredentialCreationOptions;
    credential = (await navigator.credentials.create({
      publicKey: parsed,
    })) as PublicKeyCredential | null;
  } else {
    const source =
      start.options as unknown as PublicKeyCredentialRequestOptions;
    credential = (await navigator.credentials.get({
      publicKey: {
        ...options,
        allowCredentials: source.allowCredentials?.map((c) => ({
          ...c,
          id: decode(c.id as unknown as string),
        })),
      } as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;
  }
  if (!credential) throw new Error("Passkey request cancelled.");
  const response = credential.response;
  const data = {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      ...(response instanceof AuthenticatorAttestationResponse
        ? {
            attestationObject: encode(response.attestationObject),
            transports: response.getTransports(),
          }
        : {
            authenticatorData: encode(
              (response as AuthenticatorAssertionResponse).authenticatorData,
            ),
            signature: encode(
              (response as AuthenticatorAssertionResponse).signature,
            ),
            userHandle: (response as AuthenticatorAssertionResponse).userHandle
              ? encode((response as AuthenticatorAssertionResponse).userHandle!)
              : null,
          }),
    },
  };
  await api("/auth/passkey/" + ceremony + "/verify", "POST", {
    challenge_id: start.challenge_id,
    credential: data,
  });
}
