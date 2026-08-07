/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Override the API base URL. Unset in development, where Vite proxies
   * `/api` to the backend so the browser sees a same-origin request.
   * Set it at build time when the frontend and backend are deployed to
   * different hosts.
   */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
