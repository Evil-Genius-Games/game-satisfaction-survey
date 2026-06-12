import crypto from 'crypto';

const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT_COST = 16384;
const PASSWORD_SCRYPT_BLOCK_SIZE = 8;
const PASSWORD_SCRYPT_PARALLELIZATION = 1;
const PASSWORD_MIN_LENGTH = 8;

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      {
        N: PASSWORD_SCRYPT_COST,
        r: PASSWORD_SCRYPT_BLOCK_SIZE,
        p: PASSWORD_SCRYPT_PARALLELIZATION,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });
}

export function validateAdminPassword(password: unknown) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    } as const;
  }

  return { ok: true } as const;
}

export async function hashAdminPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = await scryptAsync(password, salt);

  return {
    salt,
    hash: hash.toString('base64url'),
  };
}

export async function verifyAdminPassword(password: string, salt: string, storedHash: string) {
  const candidateHash = await scryptAsync(password, salt);
  const storedHashBuffer = Buffer.from(storedHash, 'base64url');

  return (
    candidateHash.length === storedHashBuffer.length &&
    crypto.timingSafeEqual(candidateHash, storedHashBuffer)
  );
}
