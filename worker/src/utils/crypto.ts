// Password hashing using Web Crypto API (PBKDF2)
// Format: salt:hash (both in hex)

// Helper: Convert Uint8Array to hex string
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) throw new Error('Invalid hex string');
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate a random salt (16 bytes = 128 bits)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import the password as a key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive bits using PBKDF2 (256 bits = 32 bytes)
  const hashBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  );
  
  const hash = new Uint8Array(hashBits);
  
  // Convert to hex strings
  const saltHex = uint8ArrayToHex(salt);
  const hashHex = uint8ArrayToHex(hash);
  
  // Return format: salt:hash (both hex)
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = hash.split(':');
    if (!saltHex || !hashHex) return false;
    
    // Convert hex strings back to Uint8Array
    const salt = hexToUint8Array(saltHex);
    const storedHash = hexToUint8Array(hashHex);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Import the password as a key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive bits using PBKDF2 (256 bits = 32 bytes)
    const hashBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 256 bits = 32 bytes
    );
    
    const computedHash = new Uint8Array(hashBits);
    
    // Constant-time comparison
    if (computedHash.length !== storedHash.length) return false;
    
    let equal = true;
    for (let i = 0; i < computedHash.length; i++) {
      equal = equal && (computedHash[i] === storedHash[i]);
    }
    
    return equal;
  } catch {
    return false;
  }
}
