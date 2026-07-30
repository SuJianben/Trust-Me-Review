import { z } from "zod";

export const productRequestSettingSchema = z.object({
  requestEnabled: z.boolean(),
});
