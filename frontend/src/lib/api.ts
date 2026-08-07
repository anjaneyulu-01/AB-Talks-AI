/**
 * API client.
 *
 * One fetch wrapper, one error type, one place that knows the base URL.
 * The backend returns a consistent `{error: {code, message}}` envelope, so
 * every failure surfaces a human sentence rather than a status code — the UI
 * never has to invent copy for an error it doesn't understand.
 */

import type {
  CandidateListItem,
  CandidateProfileResponse,
  CurriculumResponse,
  HealthResponse,
  HistoryResponse,
  InterviewState,
  TurnResponse,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    // Network-level failure. The backend never saw this request, so its error
    // envelope can't help us — supply our own human sentence.
    throw new ApiError(
      "Couldn't reach the interview service. Check your connection and try again.",
      'network_error',
      0,
    )
  }

  if (!response.ok) {
    let code = 'unknown_error'
    let message = 'Something went wrong. Please try again.'
    try {
      const body = await response.json()
      if (body?.error) {
        code = body.error.code ?? code
        message = body.error.message ?? message
      }
    } catch {
      // Non-JSON error body (proxy, gateway). Keep the defaults.
    }
    throw new ApiError(message, code, response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<HealthResponse>('/v1/health'),

  candidates: () => request<CandidateListItem[]>('/v1/candidates'),

  candidateProfile: (id: string) =>
    request<CandidateProfileResponse>(`/v1/candidates/${id}/profile`),

  candidateHistory: (id: string) =>
    request<HistoryResponse>(`/v1/candidates/${id}/history`),

  curriculum: () => request<CurriculumResponse>('/v1/curriculum'),

  startInterview: (candidateId: string) =>
    request<InterviewState>('/v1/interviews', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId }),
    }),

  getInterview: (sessionId: string) =>
    request<InterviewState>(`/v1/interviews/${sessionId}`),

  submitTurn: (sessionId: string, message: string) =>
    request<TurnResponse>(`/v1/interviews/${sessionId}/turns`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  getReport: (sessionId: string) =>
    request<import('./types').FeedbackReport>(`/v1/interviews/${sessionId}/report`),

  diagnostics: (sessionId: string) =>
    request<Record<string, unknown>>(`/v1/interviews/${sessionId}/diagnostics`),
}
