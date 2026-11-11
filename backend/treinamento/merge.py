import os
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = os.getenv(
    "BASE_MODEL",
    "meta-llama/Llama-3.2-1B-Instruct",
)
TOKEN = os.environ["HF_TOKEN"]

base = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    token=TOKEN,
    dtype=torch.float32,
    device_map="cpu",
    low_cpu_mem_usage=True,
)

model = PeftModel.from_pretrained(
    base,
    "/workspace/output/adapter",
)
model = model.merge_and_unload()

model.save_pretrained(
    "/workspace/output/merged",
    safe_serialization=True,
    max_shard_size="2GB",
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=TOKEN)
tokenizer.save_pretrained("/workspace/output/merged")