CATEGORY_OPTIONS_BY_TYPE: dict[str, list[str]] = {
    "income": [
        "Salary",
        "Freelance",
        "Business",
        "Investment Returns",
        "Gift Received",
        "Others",
    ],
    "expense": [
        "Food & Drink",
        "Transport",
        "Entertainment",
        "Shopping",
        "Health",
        "Utility",
        "Housing",
        "Others",
    ],
}

ALL_CATEGORY_OPTIONS: list[str] = list(
    dict.fromkeys(
        CATEGORY_OPTIONS_BY_TYPE["income"] + CATEGORY_OPTIONS_BY_TYPE["expense"]
    )
)