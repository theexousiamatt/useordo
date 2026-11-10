import { useRef } from "react";
/** A failed request can be retried safely; an edited draft receives a new command ID. */
export function useRequestId() {
  const request = useRef<{ fingerprint: string; id: string } | undefined>(undefined);
  return (input: unknown) => {
    const fingerprint = JSON.stringify(input);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    return request.current.id;
  };
}

