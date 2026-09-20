"""Turns two model outputs into one alert, or into silence."""

FAMILY_WEIGHT = {
    "DDoS": 1.0, "Bot": 1.0, "WebAttack": 0.9, "DoS": 0.85,
    "BruteForce": 0.8, "Unknown": 0.8, "PortScan": 0.5,
}

MITRE = {
    "DoS": ("Impact", "T1499 Endpoint Denial of Service"),
    "DDoS": ("Impact", "T1498 Network Denial of Service"),
    "PortScan": ("Discovery", "T1046 Network Service Discovery"),
    "BruteForce": ("Credential Access", "T1110 Brute Force"),
    "WebAttack": ("Initial Access", "T1190 Exploit Public-Facing Application"),
    "Bot": ("Command and Control", "T1071 Application Layer Protocol"),
    "Unknown": ("Unmapped", "Analyst to classify"),
}

ACTION = {
    "DoS": "Investigate the destination service; consider rate limiting",
    "DDoS": "Check upstream traffic volume; engage DDoS mitigation",
    "PortScan": "Identify the scanning host; confirm it is not an internal scanner",
    "BruteForce": "Check authentication logs for this source; lock the account if needed",
    "WebAttack": "Review web server logs and WAF rules for this path",
    "Bot": "Isolate the host and check for beaconing to external addresses",
    "Unknown": "Traffic does not match normal behaviour or any known attack. Review manually.",
}


def severity(confidence, anomaly_pct, family):
    score = 100 * (0.5 * float(confidence) + 0.3 * float(anomaly_pct)
                   + 0.2 * FAMILY_WEIGHT.get(family, 0.7))
    score = round(min(score, 100))
    level = ("Critical" if score >= 85 else "High" if score >= 65
             else "Medium" if score >= 40 else "Low")
    return score, level


def decide(attack_score, family, confidence, anomaly_score, anomaly_pct,
           is_anomalous, attack_threshold, out_of_family=False):
    """Returns an alert dict, or None when nothing should reach the analyst.

    Nothing here blocks traffic. The worst case is one more line in a queue.

    `out_of_family` is the classifier's own label being rejected: the flow does
    not look like the family it was assigned (see ml/models/novelty.py). A
    confident label on traffic outside everything the model was trained on is the
    normal behaviour of a softmax, not evidence, so we do not let confidence
    alone carry a flow to the analyst under a family name.
    """
    known = attack_score >= attack_threshold
    if not known and not is_anomalous:
        return None

    # A named flow that looks nothing like that family is reported as Unknown.
    #
    # This deliberately does NOT also require the detector to call the flow
    # abnormal. Requiring both was the first version and it cost most of the
    # benefit: on the held-out families, Heartbleed is never flagged abnormal at
    # a 1% benign flag rate, so the gate suppressed every rejection the distance
    # check made (0% shown as Unknown instead of 100%). The distance check is
    # independent evidence and does not need the detector to corroborate it. The
    # measured price of dropping the gate is small -- alerts on genuine known
    # families wrongly shown as Unknown go from 0.50% to 0.80%.
    mislabelled = bool(known and out_of_family)

    if known and not mislabelled:
        shown, conf, novel = family, confidence, False
    else:
        shown, conf, novel = "Unknown", float(anomaly_pct), True

    # A flow the classifier names but the detector also finds abnormal is often a
    # variant of a known family, or a new attack wearing familiar clothes. We say so
    # rather than hiding it behind a confident label.
    also_abnormal = bool(known and is_anomalous)

    score, level = severity(conf, anomaly_pct, shown)
    tactic, technique = MITRE.get(shown, MITRE["Unknown"])
    out = {
        "prediction": {"family": shown, "confidence": round(float(conf), 3)},
        "anomaly_score": round(float(anomaly_score), 3),
        "is_novel": novel,
        "also_abnormal": also_abnormal,
        "severity": {"score": score, "level": level},
        "mitre": {"tactic": tactic, "technique": technique},
        "recommended_action": ACTION.get(shown, ACTION["Unknown"]),
    }
    if mislabelled:
        # Say what the classifier wanted to call it. An analyst chasing a novel
        # flow needs to know which family it resembled enough to be assigned.
        out["rejected_label"] = {"family": family, "confidence": round(float(confidence), 3)}
    return out
