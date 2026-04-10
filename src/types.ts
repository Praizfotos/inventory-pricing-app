export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: 'admin' | 'associate';
  createdAt: string;
}

export interface Item {
  id: number;
  name: string;
  price: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: number;
  itemId: number;
  oldPrice: number;
  newPrice: number;
  changedBy: number;
  changedAt: string;
}

export interface JwtPayload {
  userId: number;
  role: 'admin' | 'associate';
  exp?: number;
}

// Extend Express Request to carry authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
