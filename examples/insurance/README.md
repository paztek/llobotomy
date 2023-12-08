Insurance assistant
===================

The example assumes that an assistant has already been created on OpenAI using the [assistant.json](./assistant.json) file.

## Setup

Set your OpenAI API key in the environment variable `OPENAI_API_KEY` and the ID of the assistant in the environment variable `OPENAI_ASSISTANT_ID` via the .env file

```
OPENAI_API_KEY=
OPENAI_ASSISTANT_ID=
```

## Scenario

In the same thread:

### "Quelle est la franchise pour un dégât des eaux pour le client ABC ?"

1. Assistant determines that it needs to obtain the profile of customer ABC
2. We give it to it
3. Assistant correctly guesses that the Habitation contract is the one most likely to provide coverage for "Dégât des eaux"
4. Assistant identifies the ID of the product of the Habitation contract of the customer: "HOME"
5. Assistant requests the infos about the product "HOME" from the Product Catalog
6. We give it to it
5. Assistant reformulates the query (that's the most awesome part): "franchise pour un dégât des eaux formule PLUS" and asks us to search in the knowledge base
6. We search in the knowledge base and provide the relevant chunk(s) to it
7. Assistant generates the final answer

### "A-t-il un contrat Protection Juridique ?"

1. Assistant remembers the profile of customer ABC from its context
2. Assistant returns immediately the answer

### "Est-ce que la cliente DEF est mieux couverte que ce client avec son contrat habitation ?"

1. Assistant is context-aware and correctly assumes that "ce client" is still customer ABC
2. Assistant remembers from its context the profile of customer ABC
3. Assistant determines that it needs to obtain the profile of customer DEF
4. We give it to it
5. Assistant compares the two profiles and determines that the customer ABC is better covered than the customer DEF
6. Assistant generates its final answer

### "Quelles sont les garanties incluses dans le produit Auto Tiers (CAR) ?"

1. Assistant correctly assumes that "(CAR)" is the ID of a product
2. Assistant requests the infos about the product "CAR" from the Product Catalog
3. We give it to it
4. Assistant generates the final answer by assuming that "Tiers" is the formula we're asking about

### "Est-ce que le client XYZ est couvert contre les incendies ?"

1. Assistant determines that it needs to obtain the profile of customer XYZ
2. Retrieving the customer XYZ throws an error as it doesn't existin our database
3. The error message is returned to the assistant instead of a customer profile
4. Assistant generates the final answer
