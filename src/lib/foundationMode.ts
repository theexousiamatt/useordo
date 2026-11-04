import { isFoundationEnvironment } from "./foundationEnvironment";

export const FOUNDATION_MODE = isFoundationEnvironment(import.meta.env);
export const GOOGLE_AUTH_ENABLED = !FOUNDATION_MODE || import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";
