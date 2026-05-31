import crypto from 'crypto';

export const generateKey = (size = 50) => {
  const buffer = crypto.randomBytes(size);
  return buffer.toString('base64url').substring(0, size);
};

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
