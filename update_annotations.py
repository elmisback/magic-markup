from guidance import models, gen, user, assistant

gpt = models.OpenAI("gpt-3.5-turbo")

with user():
    lm = gpt + "What is the capital of France?"

with assistant():
    lm += gen("capital")

with user():
    lm += "What is one short surprising fact about it?"

with assistant():
    lm += gen("fact")