import { Request, Response, NextFunction } from "express";

// Admin middleware that only allows access to benn@modia.ai
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required. Please log in."
    });
  }

  // Check if user is the specific admin
  if (req.user.email !== "benn@modia.ai") {
    return res.status(403).json({
      message: "Forbidden: Admin access required. Please log in with the admin account."
    });
  }

  // User is authorized admin
  next();
}