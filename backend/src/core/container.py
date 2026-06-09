import logging

from dependency_injector import containers, providers

from src.core.config import get_config
from src.services.users_service import UsersService

logger = logging.getLogger(__name__)


class Container(containers.DeclarativeContainer):
    wiring_config = containers.WiringConfiguration(
        modules=[
            "src.api.endpoints.users",
        ],
    )

    config = providers.Singleton(get_config)

    # Services talk to Beanie documents directly; no session factory needed.
    users_service = providers.Factory(UsersService)
