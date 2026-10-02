"use server";

import { z } from "zod";
import { authApi } from "@/services/auth"; // resolves SERVER_BACKEND_URL when run on the server
import { getTranslations } from "next-intl/server";

const schema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/\d/)
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/),
});

export type ResetPasswordState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const t = await getTranslations("resetPassword");
  const raw = {
    token: formData.get("token") as string,
    password: formData.get("password") as string,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.data === undefined && !raw.token
        ? t("invalidToken")
        : t("weakPassword"),
    };
  }

  try {
    await authApi.resetPassword(parsed.data.token, parsed.data.password);
    return { status: "success" };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
