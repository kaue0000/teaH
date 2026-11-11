import os
import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

MODEL_ID = os.getenv(
    "BASE_MODEL",
    "meta-llama/Llama-3.2-1B-Instruct",
)
TOKEN = os.getenv("HF_TOKEN") or None
ADAPTER_DIR = "/workspace/output/adapter"

dataset = load_dataset(
    "json",
    data_files={
        "train": "/workspace/dataset/treino.jsonl",
        "validation": "/workspace/dataset/validacao.jsonl",
    },
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=TOKEN)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    token=TOKEN,
    dtype=torch.float32,
    device_map="cpu",
    low_cpu_mem_usage=True,
)
model.config.use_cache = False

lora = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "v_proj"],
)

config = SFTConfig(
    output_dir="/workspace/output/checkpoints",
    num_train_epochs=3,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    eval_strategy="epoch",
    save_strategy="epoch",
    logging_steps=1,
    max_length=256,
    use_cpu=True,
    gradient_checkpointing=True,
    bf16=False,
    fp16=False,
    dataloader_pin_memory=False,
    report_to="none",
    seed=42,
)

trainer = SFTTrainer(
    model=model,
    args=config,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    processing_class=tokenizer,
    peft_config=lora,
)

trainer.train()
trainer.model.save_pretrained(ADAPTER_DIR, safe_serialization=True)
tokenizer.save_pretrained(ADAPTER_DIR)

expected_files = ("adapter_config.json", "adapter_model.safetensors")
missing_files = [
    filename
    for filename in expected_files
    if not os.path.isfile(os.path.join(ADAPTER_DIR, filename))
]
if missing_files:
    raise RuntimeError(
        f"Adapter training completed but expected files are missing from "
        f"{ADAPTER_DIR}: {', '.join(missing_files)}"
    )

print(f"Adapter saved successfully to {ADAPTER_DIR}")