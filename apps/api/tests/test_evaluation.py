from app.evaluation import run_evaluation


def test_golden_evaluation_meets_quality_threshold() -> None:
    report = run_evaluation()
    assert report["summary"]["total"] == 5
    assert report["summary"]["pass_rate"] >= 0.8
    assert report["summary"]["citation_coverage"] == 1.0
    assert report["summary"]["action_policy_pass_rate"] == 1.0
