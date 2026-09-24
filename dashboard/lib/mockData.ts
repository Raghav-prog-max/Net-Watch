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

export interface EvaluationReport {
  classifier: string;
  threshold: {
    threshold: number;
    fpr_at_threshold: number;
    recall_at_threshold: number;
    budget_target: number;
  };
  main: SummaryMetrics;
  naive_comparison: {
    split_method: string;
    macro_f1: number;
    pr_auc_mean: number;
    false_alerts_per_10k: number;
    leakage_explanation: string;
    honest_macro_f1: number;
    honest_false_alerts_per_10k: number;
  };
  lofo: {
    family: string;
    test_flows: number;
    caught_by_classifier_alone: number;
    caught_by_full_system: number;
    benign_fpr: number;
    delta_gain: number;
  }[];
  novel_families: {
    families: string[];
    flows: number;
    caught_by_anomaly_detector: number;
  };
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

export const MOCK_EVALUATION_REPORT: EvaluationReport = {
  classifier: "LightGBM (HistGradientBoosting fallback)",
  threshold: {
    threshold: 0.812,
    fpr_at_threshold: 0.0048,
    recall_at_threshold: 0.941,
    budget_target: 0.005,
  },
  main: {
    per_class: {
      Benign: { precision: 0.998, recall: 0.995, "f1-score": 0.996, support: 420850 },
      DoS: { precision: 0.974, recall: 0.962, "f1-score": 0.968, support: 18420 },
      DDoS: { precision: 0.988, recall: 0.979, "f1-score": 0.983, support: 24150 },
      PortScan: { precision: 0.952, recall: 0.924, "f1-score": 0.938, support: 15890 },
      BruteForce: { precision: 0.941, recall: 0.915, "f1-score": 0.928, support: 3420 },
      WebAttack: { precision: 0.892, recall: 0.854, "f1-score": 0.873, support: 2180 },
      Bot: { precision: 0.915, recall: 0.887, "f1-score": 0.901, support: 1960 },
    },
    macro_f1: 0.941,
    false_positive_rate: 0.0048,
    false_alerts_per_10k_benign_flows: 48.0,
    auc: {
      Benign: { pr_auc: 0.999, roc_auc: 0.998 },
      DoS: { pr_auc: 0.982, roc_auc: 0.991 },
      DDoS: { pr_auc: 0.994, roc_auc: 0.997 },
      PortScan: { pr_auc: 0.965, roc_auc: 0.984 },
      BruteForce: { pr_auc: 0.948, roc_auc: 0.979 },
      WebAttack: { pr_auc: 0.891, roc_auc: 0.962 },
      Bot: { pr_auc: 0.922, roc_auc: 0.975 },
    },
    confusion_matrix: {
      labels: ["Benign", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Bot"],
      rows: [
        [418745, 412, 185, 920, 245, 198, 145],
        [320, 17720, 210, 85, 42, 33, 10],
        [140, 180, 23642, 110, 38, 25, 15],
        [680, 120, 95, 14682, 185, 88, 40],
        [110, 35, 15, 95, 3129, 24, 12],
        [145, 40, 20, 75, 28, 1862, 10],
        [98, 12, 15, 62, 18, 17, 1738],
      ],
    },
    accuracy_for_reference_only: 0.9938,
  },
  naive_comparison: {
    split_method: "Naive Random Split (Scikit-Learn train_test_split)",
    macro_f1: 0.9984,
    pr_auc_mean: 0.9991,
    false_alerts_per_10k: 1.2,
    leakage_explanation:
      "Packets inside one attack burst are near-identical copies arriving in sub-second clusters. A random split distributes duplicates of the same burst into both train and test. The model memorizes exact flow shapes, creating artificially pristine test numbers that fail in production on day 2.",
    honest_macro_f1: 0.941,
    honest_false_alerts_per_10k: 48.0,
  },
  lofo: [
    {
      family: "PortScan",
      test_flows: 15890,
      caught_by_classifier_alone: 0.245,
      caught_by_full_system: 0.884,
      benign_fpr: 0.0098,
      delta_gain: 0.639,
    },
    {
      family: "BruteForce",
      test_flows: 3420,
      caught_by_classifier_alone: 0.312,
      caught_by_full_system: 0.912,
      benign_fpr: 0.0102,
      delta_gain: 0.600,
    },
    {
      family: "WebAttack",
      test_flows: 2180,
      caught_by_classifier_alone: 0.185,
      caught_by_full_system: 0.865,
      benign_fpr: 0.0101,
      delta_gain: 0.680,
    },
    {
      family: "Bot",
      test_flows: 1960,
      caught_by_classifier_alone: 0.218,
      caught_by_full_system: 0.842,
      benign_fpr: 0.0095,
      delta_gain: 0.624,
    },
  ],
  novel_families: {
    families: ["Infiltration (36 flows)", "Heartbleed (11 flows)"],
    flows: 47,
    caught_by_anomaly_detector: 0.936,
  },
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
