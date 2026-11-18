export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) => new ApiError(400, msg, fields);
export const unauthorized = (msg = "Please sign in to continue") => new ApiError(401, msg);
export const forbidden = (msg = "You don't have permission to do that") => new ApiError(403, msg);
export const notFound = (msg = "Not found") => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);
