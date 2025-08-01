type AsyncController = (req: any, res: any, next: any) => Promise<any>;

export const asyncHandler = (controller: AsyncController): AsyncController => {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
