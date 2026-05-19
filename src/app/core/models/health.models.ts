export interface HealthStatus {
  status: string;
}

export interface ReadyStatus {
  status: string;
  db: number;
}

export interface HealthDetailed {
  status: string;
  checks: {
    db: boolean;
    config: boolean;
    cache?: boolean;
  };
}

export interface ReadinessStatus {
  ready: boolean;
  details: Record<string, unknown>;
}

export interface LivenessStatus {
  alive: boolean;
}
