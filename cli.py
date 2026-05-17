import argparse
import os
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).parent

def _resolve_config(name: str) -> None:
    config_path = _ROOT / "configs" / f"{name}.yaml"
    if not config_path.exists():
        available = sorted(
            p.stem for p in (_ROOT / "configs").glob("*.yaml")
            if not p.stem.startswith("_")
        )
        print(f"Config '{name}' not found.", file=sys.stderr)
        print(f"Available: {', '.join(available) or '(none)'}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="agents",
        description="Deploy and run Modal LLM serving configs.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    deploy_p = sub.add_parser("deploy", help="Deploy a model config to Modal")
    deploy_p.add_argument("config", help="Config name (resolves to configs/<name>.yaml)")

    run_p = sub.add_parser("run", help="Spin up a model and run a health check")
    run_p.add_argument("config", help="Config name (resolves to configs/<name>.yaml)")

    args = parser.parse_args()
    _resolve_config(args.config)

    main_py = str(_ROOT / "main.py")

    if args.command == "deploy":
        subprocess.run(
            ["modal", "deploy", main_py],
            env={**os.environ, "MODEL_CONFIG": args.config},
            check=True,
        )
    elif args.command == "run":
        subprocess.run(
            ["modal", "run", main_py, "--", "--config", args.config],
            check=True,
        )


if __name__ == "__main__":
    main()
