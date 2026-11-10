import "server-only";

import { z } from "zod";
import { apiFetch } from "@/lib/api-format";
import {
  EncounterSchema,
  HomeIntervalSchema,
  MedicationsSchema,
  PrecautionsSchema,
  ProceduresSchema,
  RoundsSchema,
  TodaySchema,
  type Encounter,
  type HomeInterval,
  type Medications,
  type Precaution,
  type Procedures,
  type Rounds,
  type Today,
} from "@/lib/schema";

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}`;

export function listEncounters(patientId: string): Promise<Encounter[]> {
  return apiFetch(`${base(patientId)}/encounters`, { schema: z.array(EncounterSchema) });
}

export function getToday(patientId: string): Promise<Today> {
  return apiFetch(`${base(patientId)}/today`, { schema: TodaySchema });
}

export function getMedications(patientId: string): Promise<Medications> {
  return apiFetch(`${base(patientId)}/medications`, { schema: MedicationsSchema });
}

export function getProcedures(patientId: string): Promise<Procedures> {
  return apiFetch(`${base(patientId)}/procedures`, { schema: ProceduresSchema });
}

export function getPrecautions(patientId: string): Promise<Precaution[]> {
  return apiFetch(`${base(patientId)}/precautions`, { schema: PrecautionsSchema });
}

export function listHomeIntervals(patientId: string): Promise<HomeInterval[]> {
  return apiFetch(`${base(patientId)}/home-intervals`, { schema: z.array(HomeIntervalSchema) });
}

export function getHomeInterval(patientId: string, intervalId: string): Promise<HomeInterval> {
  return apiFetch(`${base(patientId)}/home-intervals/${encodeURIComponent(intervalId)}`, {
    schema: HomeIntervalSchema,
  });
}

export function getRounds(patientId: string): Promise<Rounds> {
  return apiFetch(`${base(patientId)}/rounds`, { schema: RoundsSchema });
}
