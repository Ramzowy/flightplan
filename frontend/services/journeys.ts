import "server-only";

import { apiFetch } from "@/lib/api-format";
import { CarePathSchema, JourneyNodeDetailSchema, type CarePath, type ContentDepth, type JourneyNodeDetail } from "@/lib/schema";

export function getJourneyRoot(patientId: string, depth?: ContentDepth): Promise<JourneyNodeDetail> {
  return apiFetch(`/patients/${encodeURIComponent(patientId)}/journey`, {
    query: { depth },
    schema: JourneyNodeDetailSchema,
  });
}

export function getJourneyNode(patientId: string, nodeId: string, depth?: ContentDepth): Promise<JourneyNodeDetail> {
  return apiFetch(`/patients/${encodeURIComponent(patientId)}/journey/${encodeURIComponent(nodeId)}`, {
    query: { depth },
    schema: JourneyNodeDetailSchema,
  });
}

export function getCarePath(patientId: string): Promise<CarePath> {
  return apiFetch(`/patients/${encodeURIComponent(patientId)}/care-path`, { schema: CarePathSchema });
}
