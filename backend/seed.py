from sqlalchemy import select
from sqlalchemy.orm import Session

import models

DEFAULT_CATEGORIES = [
    {
        "name": "Potraviny",
        "description": "Bežné nákupy potravín a drogérie",
        "keywords": ["lidl", "tesco", "milk", "chlieb", "potraviny", "coop"],
    },
    {
        "name": "Doprava",
        "description": "PHM, cestovanie, MHD",
        "keywords": ["benz", "shell", "omv", "bus", "vlak", "mhd"],
    },
    {
        "name": "Domácnosť",
        "description": "Domáce potreby, elektro, hobby",
        "keywords": ["ikea", "hornbach", "bau", "obi", "elektro"],
    },
    {
        "name": "Stravovanie",
        "description": "Reštaurácie, kaviarne",
        "keywords": ["kavia", "restaurant", "bistro", "pub", "cafe"],
    },
]


def seed_reference_data(session: Session) -> None:
    existing_categories = {
        name for (name,) in session.execute(select(models.Category.name)).all()
    }

    for category in DEFAULT_CATEGORIES:
        if category["name"] in existing_categories:
            continue

        new_category = models.Category(
            name=category["name"], description=category["description"]
        )
        session.add(new_category)
        session.flush()  # need id for rules

        for keyword in category["keywords"]:
            session.add(
                models.CategoryRule(pattern=keyword.lower(), category_id=new_category.id)
            )
