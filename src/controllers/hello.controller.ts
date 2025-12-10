import type { Request, Response } from 'express';

const DEFAULT_NAME = 'world';

export const helloController = (req: Request, res: Response): void => {
  const { name } = req.query;
  const candidate = Array.isArray(name) ? name[0] : name;
  const normalized = typeof candidate === 'string' ? candidate.trim() : undefined;
  const target = normalized && normalized.length > 0 ? normalized : DEFAULT_NAME;

  res.status(200).json({ message: `Hello, ${target}!` });
};
