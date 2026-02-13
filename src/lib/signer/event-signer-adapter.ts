import type { EventSigner } from 'applesauce-core';
import type { NIP44Signer } from './types';

export type { EventSigner };

/**
 * Adapts our NIP44Signer to the EventSigner interface used by marmot-ts.
 *
 * Maps:
 *   NIP44Signer.getPublicKey()     → EventSigner.getPublicKey()
 *   NIP44Signer.signEvent()        → EventSigner.signEvent()
 *   NIP44Signer.nip44Encrypt()     → EventSigner.nip44.encrypt()
 *   NIP44Signer.nip44Decrypt()     → EventSigner.nip44.decrypt()
 */
export function signerToEventSigner(signer: NIP44Signer): EventSigner {
  return {
    getPublicKey: () => signer.getPublicKey(),
    signEvent: (template) => signer.signEvent(template),
    nip44: {
      encrypt: (pubkey: string, plaintext: string) => signer.nip44Encrypt(pubkey, plaintext),
      decrypt: (pubkey: string, ciphertext: string) => signer.nip44Decrypt(pubkey, ciphertext),
    },
  };
}
