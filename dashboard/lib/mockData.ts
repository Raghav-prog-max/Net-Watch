import type { Alert, DriftStatus, Level } from "./types";

export interface ClassMetrics {
  precision: number;
  recall: number;
  "f1-score": number;
  support: number;
}

export interface SummaryMetrics {
  per_class: Record<string, ClassMetrics>;
  macro_f1: number;
  false_positive_rate: number;
  false_alerts_per_10k_benign_flows: number;
  auc: Record<string, { pr_auc: number; roc_auc: number }>;
  confusion_matrix: { labels: string[]; rows: number[][] };
  accuracy_for_reference_only: number;
}

// Mirrors reports/metrics.json as written by `make train` and served, unchanged,
// by GET /metrics/model. Nothing in it is estimated by the dashboard.
export interface EvaluationReport {
  generated?: string;
  classifier: string;
  rows?: { train: number; val: number; test: number };
  threshold: {
    threshold: number;
    fpr_at_threshold: number;
    recall_at_threshold: number;
    fpr_budget: number;
  };
  main: SummaryMetrics;
  random_forest_baseline?: SummaryMetrics;
  // The same model on a random row split (ml/evaluate/naive.py). Absent in
  // reports from before it was added; the page then says "Not measured yet".
  naive_comparison?: {
    split?: string;
    classifier?: string;
    rows?: { train: number; val: number; test: number };
    threshold?: number;
    per_class_f1?: Record<string, number>;
    honest_false_alerts_per_10k?: number;
    macro_f1: number;
    false_alerts_per_10k: number;
    macro_f1_over_seeds?: { seeds: number; min: number; max: number; mean: number };
    test_flows_from_blocks_seen_in_training?: number | null;
    honest_macro_f1?: number;
    macro_f1_gap?: number;
    inflated?: boolean;
  };
  lofo: {
    family: string;
    test_flows: number;
    attack_threshold?: number;
    caught_by_classifier_alone: number;
    caught_by_anomaly_detector_alone?: number;
    caught_by_full_system: number;
    benign_fpr: number;
  }[];
  novel_families: {
    families: string[];
    flows: number;
    alerted?: number;
    caught_by_anomaly_detector: number;
    label_rejected_as_out_of_family?: number;
    shown_as_unknown?: number;
  };
  synthetic_data?: boolean;
  // added by lib/api.ts: "live" from the API, "snapshot" when it is unreachable
  source?: "live" | "snapshot";
}

export const INITIAL_MOCK_ALERTS: Alert[] = [
  {
    id: "alt_c4a8f90112",
    timestamp: new Date(Date.now() - 42 * 1000).toISOString(),
    flow: {
      src_ip: "192.168.10.50",
      dst_ip: "172.16.0.1",
      dst_port: "80",
      protocol: "TCP",
      truth: "DDoS",
      duration: "118.4s",
      flow_bytes_s: "142850",
      fwd_packets: "4820",
    },
    prediction: { family: "DDoS", confidence: 0.962 },
    anomaly_score: -0.284,
    is_novel: false,
    also_abnormal: true,
    severity: { score: 94, level: "Critical" },
    explanation: [
      { feature: "Flow Bytes/s", value: 142850, impact: 0.38 },
      { feature: "Total Fwd Packets", value: 4820, impact: 0.29 },
      { feature: "Flow Duration", value: 118400000, impact: 0.22 },
      { feature: "Bwd Packet Length Mean", value: 12.4, impact: -0.11 },
      { feature: "Flow IAT Mean", value: 24.5, impact: -0.09 },
      { feature: "SYN Flag Count", value: 1, impact: 0.08 },
    ],
    mitre: {
      tactic: "Impact",
      technique: "T1498 Network Denial of Service",
    },
    recommended_action: "Check upstream traffic volume; engage DDoS mitigation on perimeter edge.",
    status: "open",
    analyst_label: null,
    analyst_note: null,
    model_version: "v1",
  },
  {
    id: "alt_88e1a3bc09",
    timestamp: new Date(Date.now() - 118 * 1000).toISOString(),
    flow: {
      src_ip: "172.16.0.105",
      dst_ip: "192.168.10.8",
      dst_port: "443",
      protocol: "TCP",
      truth: "Infiltration",
      duration: "0.84s",
      flow_bytes_s: "840",
      fwd_packets: "6",
    },
    prediction: { family: "Unknown", confidence: 0.895 },
    anomaly_score: -0.342,
    is_novel: true,
    also_abnormal: true,
    severity: { score: 88, level: "Critical" },
    explanation: [
      { feature: "Flow IAT Std", value: 1420500, impact: 0.42 },
      { feature: "Fwd Packet Length Mean", value: 420.5, impact: 0.31 },
      { feature: "Packet Length Variance", value: 89400, impact: 0.24 },
      { feature: "Flow IAT Mean", value: 182000, impact: 0.18 },
      { feature: "ACK Flag Count", value: 4, impact: 0.12 },
    ],
    mitre: {
      tactic: "Unmapped",
      technique: "Analyst to classify (Novel Zero-Day Anomaly)",
    },
    recommended_action: "Traffic does not match normal behaviour or any known attack. Review manually.",
    status: "open",
    analyst_label: null,
    analyst_note: null,
    model_version: "v1",
  },
  {
    id: "alt_9bf24098ad",
    timestamp: new Date(Date.now() - 195 * 1000).toISOString(),
    flow: {
      src_ip: "192.168.10.51",
      dst_ip: "172.16.0.1",
      dst_port: "22",
      protocol: "TCP",
      truth: "BruteForce",
      duration: "4.12s",
      flow_bytes_s: "3890",
      fwd_packets: "38",
    },
    prediction: { family: "BruteForce", confidence: 0.884 },
    anomaly_score: -0.198,
    is_novel: false,
    also_abnormal: false,
    severity: { score: 78, level: "High" },
    explanation: [
      { feature: "Flow IAT Mean", value: 108420, impact: 0.35 },
      { feature: "Fwd Packet Length Mean", value: 84.0, impact: 0.28 },
      { feature: "SYN Flag Count", value: 1, impact: 0.19 },
      { feature: "Destination Port", value: 22, impact: 0.15 },
    ],
    mitre: {
      tactic: "Credential Access",
      technique: "T1110 Brute Force",
    },
    recommended_action: "Check authentication logs for source 192.168.10.51; enforce progressive lockouts.",
    status: "acknowledged",
    analyst_label: null,
    analyst_note: "Reviewing SSH bastion auth failures.",
    model_version: "v1",
  },
  {
    id: "alt_27a5180ce4",
    timestamp: new Date(Date.now() - 310 * 1000).toISOString(),
    flow: {
      src_ip: "172.16.0.12",
      dst_ip: "192.168.10.14",
      dst_port: "8080",
      protocol: "TCP",
      truth: "WebAttack",
      duration: "1.2s",
      flow_bytes_s: "12840",
      fwd_packets: "14",
    },
    prediction: { family: "WebAttack", confidence: 0.841 },
    anomaly_score: -0.215,
    is_novel: false,
    also_abnormal: true,
    severity: { score: 76, level: "High" },
    explanation: [
      { feature: "Fwd Packet Length Mean", value: 680.2, impact: 0.36 },
      { feature: "Packet Length Variance", value: 142000, impact: 0.28 },
      { feature: "Flow Bytes/s", value: 12840, impact: 0.21 },
      { feature: "Flow Duration", value: 1200000, impact: 0.14 },
    ],
    mitre: {
      tactic: "Initial Access",
      technique: "T1190 Exploit Public-Facing Application",
    },
    recommended_action: "Review web server access logs and inspect WAF inspection rules for path traversal.",
    status: "open",
    analyst_label: null,
    analyst_note: null,
    model_version: "v1",
  },
  {
    id: "alt_d7e31980af",
    timestamp: new Date(Date.now() - 440 * 1000).toISOString(),
    flow: {
      src_ip: "192.168.10.25",
      dst_ip: "172.16.0.5",
      dst_port: "135",
      protocol: "TCP",
      truth: "PortScan",
      duration: "0.04s",
      flow_bytes_s: "240",
      fwd_packets: "2",
    },
    prediction: { family: "PortScan", confidence: 0.724 },
    anomaly_score: -0.142,
    is_novel: false,
    also_abnormal: false,
    severity: { score: 54, level: "Medium" },
    explanation: [
      { feature: "Flow Duration", value: 40000, impact: -0.32 },
      { feature: "Total Fwd Packets", value: 2, impact: -0.26 },
      { feature: "SYN Flag Count", value: 1, impact: 0.24 },
      { feature: "Destination Port", value: 135, impact: 0.18 },
    ],
    mitre: {
      tactic: "Discovery",
      technique: "T1046 Network Service Discovery",
    },
    recommended_action: "Identify scanning host; verify whether source is an authorized vulnerability scanner.",
    status: "open",
    analyst_label: null,
    analyst_note: null,
    model_version: "v1",
  },
  {
    id: "alt_1b93f8721c",
    timestamp: new Date(Date.now() - 580 * 1000).toISOString(),
    flow: {
      src_ip: "192.168.10.99",
      dst_ip: "172.16.0.2",
      dst_port: "4444",
      protocol: "TCP",
      truth: "Bot",
      duration: "30.0s",
      flow_bytes_s: "1480",
      fwd_packets: "20",
    },
    prediction: { family: "Bot", confidence: 0.792 },
    anomaly_score: -0.231,
    is_novel: false,
    also_abnormal: true,
    severity: { score: 71, level: "High" },
    explanation: [
      { feature: "Flow IAT Mean", value: 1500000, impact: 0.41 },
      { feature: "Flow IAT Std", value: 28400, impact: -0.33 },
      { feature: "Total Backward Packets", value: 18, impact: 0.19 },
    ],
    mitre: {
      tactic: "Command and Control",
      technique: "T1071 Application Layer Protocol",
    },
    recommended_action: "Isolate client host; check for beaconing persistence and C2 channels.",
    status: "escalated",
    analyst_label: null,
    analyst_note: "Escalated to Tier-2 IR for endpoint isolation.",
    model_version: "v1",
  },
  {
    id: "alt_4c112e98d0",
    timestamp: new Date(Date.now() - 720 * 1000).toISOString(),
    flow: {
      src_ip: "10.0.4.15",
      dst_ip: "10.0.1.20",
      dst_port: "80",
      protocol: "TCP",
      truth: "DoS",
      duration: "64.2s",
      flow_bytes_s: "84200",
      fwd_packets: "2140",
    },
    prediction: { family: "DoS", confidence: 0.865 },
    anomaly_score: -0.228,
    is_novel: false,
    also_abnormal: false,
    severity: { score: 68, level: "High" },
    explanation: [
      { feature: "Flow Duration", value: 64200000, impact: 0.34 },
      { feature: "Flow Bytes/s", value: 84200, impact: 0.28 },
      { feature: "Fwd Packet Length Mean", value: 39.3, impact: -0.19 },
    ],
    mitre: {
      tactic: "Impact",
      technique: "T1499 Endpoint Denial of Service",
    },
    recommended_action: "Investigate target service CPU/connection table; adjust reverse-proxy timeouts.",
    status: "false_positive",
    analyst_label: "Benign Load Test",
    analyst_note: "Confirmed scheduled load test from internal QA cluster.",
    model_version: "v1",
  },
  {
    id: "alt_5f3089cbb1",
    timestamp: new Date(Date.now() - 890 * 1000).toISOString(),
    flow: {
      src_ip: "192.168.10.104",
      dst_ip: "172.16.0.1",
      dst_port: "443",
      protocol: "TCP",
      truth: "Heartbleed",
      duration: "0.12s",
      flow_bytes_s: "65400",
      fwd_packets: "8",
    },
    prediction: { family: "Unknown", confidence: 0.912 },
    anomaly_score: -0.365,
    is_novel: true,
    also_abnormal: true,
    severity: { score: 91, level: "Critical" },
    explanation: [
      { feature: "Bwd Packet Length Mean", value: 8175.0, impact: 0.49 },
      { feature: "Flow Bytes/s", value: 654000, impact: 0.33 },
      { feature: "Packet Length Variance", value: 3340000, impact: 0.22 },
    ],
    mitre: {
      tactic: "Unmapped",
      technique: "Analyst to classify (Novel Protocol Flaw)",
    },
    recommended_action: "Novel payload structure detected. Inspect SSL/TLS heartbeat extensions immediately.",
    status: "open",
    analyst_label: null,
    analyst_note: null,
    model_version: "v1",
  },
  {
    id: "alt_63b90a4df7",
    timestamp: new Date(Date.now() - 1040 * 1000).toISOString(),
    flow: {
      src_ip: "192.168.10.15",
      dst_ip: "172.16.0.4",
      dst_port: "80",
      protocol: "TCP",
      truth: "Benign",
      duration: "0.08s",
      flow_bytes_s: "1450",
      fwd_packets: "4",
    },
    prediction: { family: "PortScan", confidence: 0.512 },
    anomaly_score: -0.082,
    is_novel: false,
    also_abnormal: false,
    severity: { score: 38, level: "Low" },
    explanation: [
      { feature: "Total Fwd Packets", value: 4, impact: -0.22 },
      { feature: "Flow Duration", value: 80000, impact: -0.18 },
      { feature: "Destination Port", value: 80, impact: 0.12 },
    ],
    mitre: {
      tactic: "Discovery",
      technique: "T1046 Network Service Discovery",
    },
    recommended_action: "Low confidence signal. Monitor source host for repeated probe patterns.",
    status: "resolved",
    analyst_label: "Benign Web Crawler",
    analyst_note: "Standard health checker probing /healthz.",
    model_version: "v1",
  },
];

// Offline fallback: a copy of reports/metrics.json from the run below (synthetic data).
// Refresh it after retraining with `make dashboard-snapshot`.
export const MOCK_EVALUATION_REPORT: EvaluationReport = {
  "generated": "2026-09-28T21:45:21Z",
  "classifier": "lightgbm",
  "rows": {
    "train": 21381,
    "val": 8664,
    "test": 9324
  },
  "threshold": {
    "threshold": 0.9865424689764415,
    "recall_at_threshold": 0.9933,
    "fpr_at_threshold": 0.00497,
    "fpr_budget": 0.005
  },
  "main": {
    "per_class": {
      "Benign": {
        "precision": 0.9955,
        "recall": 0.9957,
        "f1-score": 0.9956,
        "support": 5598.0
      },
      "Bot": {
        "precision": 0.8324,
        "recall": 0.8011,
        "f1-score": 0.8164,
        "support": 186.0
      },
      "BruteForce": {
        "precision": 0.931,
        "recall": 0.975,
        "f1-score": 0.9525,
        "support": 360.0
      },
      "DDoS": {
        "precision": 0.8691,
        "recall": 0.8538,
        "f1-score": 0.8614,
        "support": 848.0
      },
      "DoS": {
        "precision": 0.8833,
        "recall": 0.8983,
        "f1-score": 0.8908,
        "support": 1121.0
      },
      "PortScan": {
        "precision": 1.0,
        "recall": 1.0,
        "f1-score": 1.0,
        "support": 897.0
      },
      "WebAttack": {
        "precision": 0.9337,
        "recall": 0.8673,
        "f1-score": 0.8993,
        "support": 211.0
      }
    },
    "macro_f1": 0.9166,
    "false_positive_rate": 0.00429,
    "false_alerts_per_10k_benign_flows": 42.9,
    "auc": {
      "Benign": {
        "pr_auc": 0.9999,
        "roc_auc": 0.9998
      },
      "Bot": {
        "pr_auc": 0.8522,
        "roc_auc": 0.9904
      },
      "BruteForce": {
        "pr_auc": 0.9896,
        "roc_auc": 0.9996
      },
      "DDoS": {
        "pr_auc": 0.9514,
        "roc_auc": 0.9946
      },
      "DoS": {
        "pr_auc": 0.9631,
        "roc_auc": 0.9948
      },
      "PortScan": {
        "pr_auc": 1.0,
        "roc_auc": 1.0
      },
      "WebAttack": {
        "pr_auc": 0.9557,
        "roc_auc": 0.9989
      }
    },
    "confusion_matrix": {
      "labels": [
        "Benign",
        "Bot",
        "BruteForce",
        "DDoS",
        "DoS",
        "PortScan",
        "WebAttack"
      ],
      "rows": [
        [
          5574,
          24,
          0,
          0,
          0,
          0,
          0
        ],
        [
          25,
          149,
          10,
          0,
          0,
          0,
          2
        ],
        [
          0,
          3,
          351,
          0,
          0,
          0,
          6
        ],
        [
          0,
          0,
          0,
          724,
          124,
          0,
          0
        ],
        [
          0,
          0,
          0,
          109,
          1007,
          0,
          5
        ],
        [
          0,
          0,
          0,
          0,
          0,
          897,
          0
        ],
        [
          0,
          3,
          16,
          0,
          9,
          0,
          183
        ]
      ]
    },
    "accuracy_for_reference_only": 0.9636
  },
  "random_forest_baseline": {
    "per_class": {
      "Benign": {
        "precision": 0.9959,
        "recall": 0.9962,
        "f1-score": 0.9961,
        "support": 5598.0
      },
      "Bot": {
        "precision": 0.8538,
        "recall": 0.7849,
        "f1-score": 0.8179,
        "support": 186.0
      },
      "BruteForce": {
        "precision": 0.8866,
        "recall": 0.9778,
        "f1-score": 0.93,
        "support": 360.0
      },
      "DDoS": {
        "precision": 0.8852,
        "recall": 0.855,
        "f1-score": 0.8698,
        "support": 848.0
      },
      "DoS": {
        "precision": 0.8686,
        "recall": 0.9144,
        "f1-score": 0.8909,
        "support": 1121.0
      },
      "PortScan": {
        "precision": 1.0,
        "recall": 1.0,
        "f1-score": 1.0,
        "support": 897.0
      },
      "WebAttack": {
        "precision": 0.9554,
        "recall": 0.7109,
        "f1-score": 0.8152,
        "support": 211.0
      }
    },
    "macro_f1": 0.9028,
    "false_positive_rate": 0.00375,
    "false_alerts_per_10k_benign_flows": 37.5,
    "auc": {
      "Benign": {
        "pr_auc": 0.9999,
        "roc_auc": 0.9998
      },
      "Bot": {
        "pr_auc": 0.8298,
        "roc_auc": 0.9928
      },
      "BruteForce": {
        "pr_auc": 0.9889,
        "roc_auc": 0.9996
      },
      "DDoS": {
        "pr_auc": 0.9451,
        "roc_auc": 0.9944
      },
      "DoS": {
        "pr_auc": 0.9617,
        "roc_auc": 0.9946
      },
      "PortScan": {
        "pr_auc": 1.0,
        "roc_auc": 1.0
      },
      "WebAttack": {
        "pr_auc": 0.9424,
        "roc_auc": 0.9989
      }
    },
    "confusion_matrix": {
      "labels": [
        "Benign",
        "Bot",
        "BruteForce",
        "DDoS",
        "DoS",
        "PortScan",
        "WebAttack"
      ],
      "rows": [
        [
          5577,
          21,
          0,
          0,
          0,
          0,
          0
        ],
        [
          23,
          146,
          16,
          0,
          0,
          0,
          1
        ],
        [
          0,
          4,
          352,
          0,
          0,
          0,
          4
        ],
        [
          0,
          0,
          0,
          725,
          123,
          0,
          0
        ],
        [
          0,
          0,
          0,
          94,
          1025,
          0,
          2
        ],
        [
          0,
          0,
          0,
          0,
          0,
          897,
          0
        ],
        [
          0,
          0,
          29,
          0,
          32,
          0,
          150
        ]
      ]
    },
    "accuracy_for_reference_only": 0.9622
  },
  "naive_comparison": {
    "split": "random rows (train_test_split, shuffled, stratified by family)",
    "classifier": "lightgbm",
    "rows": {
      "train": 21420,
      "val": 8910,
      "test": 8910
    },
    "threshold": 0.9825,
    "macro_f1": 0.9045,
    "false_alerts_per_10k": 55.6,
    "per_class_f1": {
      "Benign": 0.9945,
      "Bot": 0.7536,
      "BruteForce": 0.9508,
      "DDoS": 0.8622,
      "DoS": 0.8906,
      "PortScan": 1.0,
      "WebAttack": 0.8798
    },
    "test_flows_from_blocks_seen_in_training": 1.0,
    "macro_f1_over_seeds": {
      "seeds": 5,
      "min": 0.9025,
      "max": 0.9111,
      "mean": 0.9066
    },
    "honest_macro_f1": 0.9166,
    "honest_false_alerts_per_10k": 42.9,
    "macro_f1_gap": -0.0121,
    "inflated": false
  },
  "lofo": [
    {
      "family": "PortScan",
      "test_flows": 897,
      "attack_threshold": 0.9999,
      "caught_by_classifier_alone": 0.0,
      "caught_by_anomaly_detector_alone": 0.9967,
      "caught_by_full_system": 0.9967,
      "benign_fpr": 0.01304
    },
    {
      "family": "BruteForce",
      "test_flows": 360,
      "attack_threshold": 1.0,
      "caught_by_classifier_alone": 1.0,
      "caught_by_anomaly_detector_alone": 0.0306,
      "caught_by_full_system": 1.0,
      "benign_fpr": 0.01268
    },
    {
      "family": "WebAttack",
      "test_flows": 211,
      "attack_threshold": 1.0,
      "caught_by_classifier_alone": 1.0,
      "caught_by_anomaly_detector_alone": 0.9289,
      "caught_by_full_system": 1.0,
      "benign_fpr": 0.01322
    },
    {
      "family": "Bot",
      "test_flows": 186,
      "attack_threshold": 0.9997,
      "caught_by_classifier_alone": 0.1559,
      "caught_by_anomaly_detector_alone": 0.0376,
      "caught_by_full_system": 0.1774,
      "benign_fpr": 0.00875
    }
  ],
  "novel_families": {
    "families": [
      "Heartbleed",
      "Infiltration"
    ],
    "flows": 103,
    "alerted": 1.0,
    "caught_by_anomaly_detector": 1.0,
    "label_rejected_as_out_of_family": 0.932,
    "shown_as_unknown": 0.932
  },
  "synthetic_data": true
};

export const MOCK_DRIFT_STATUS: DriftStatus = {
  status: "stable",
  flows_seen: 4820,
  alert_rate: 0.0142,
  top_features: [
    { feature: "Flow Duration", psi: 0.048 },
    { feature: "Flow IAT Mean", psi: 0.039 },
    { feature: "Flow Bytes/s", psi: 0.031 },
    { feature: "Total Fwd Packets", psi: 0.024 },
    { feature: "Destination Port", psi: 0.018 },
    { feature: "Fwd Packet Length Mean", psi: 0.015 },
  ],
  recommendation: "Distribution is stable across all monitored quantiles. No retraining required.",
};

export const MOCK_DRIFT_WARNING: DriftStatus = {
  status: "warning",
  flows_seen: 5000,
  alert_rate: 0.0385,
  top_features: [
    { feature: "Flow Duration", psi: 0.182 },
    { feature: "Flow IAT Mean", psi: 0.154 },
    { feature: "Flow Bytes/s", psi: 0.118 },
    { feature: "Total Fwd Packets", psi: 0.082 },
    { feature: "Destination Port", psi: 0.045 },
  ],
  recommendation: "Two features have crossed the warning threshold (PSI > 0.10). Monitor closely for incoming shift.",
};

export const MOCK_DRIFT_CRITICAL: DriftStatus = {
  status: "drift",
  flows_seen: 5000,
  alert_rate: 0.0712,
  top_features: [
    { feature: "Flow Duration", psi: 0.384 },
    { feature: "Flow IAT Mean", psi: 0.321 },
    { feature: "Flow Bytes/s", psi: 0.289 },
    { feature: "Total Fwd Packets", psi: 0.194 },
    { feature: "Destination Port", psi: 0.098 },
  ],
  recommendation:
    "Three or more core flow features exceed critical threshold (PSI >= 0.25). Model retrain recommended. Human analyst review required to trigger retraining pipeline.",
};
