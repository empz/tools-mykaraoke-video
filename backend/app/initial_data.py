import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("No initial data to create")


if __name__ == "__main__":
    main()
