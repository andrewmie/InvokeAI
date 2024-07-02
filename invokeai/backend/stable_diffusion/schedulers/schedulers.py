from typing import Literal

from diffusers import (
    DDIMScheduler,
    DDPMScheduler,
    DEISMultistepScheduler,
    DPMSolverMultistepScheduler,
    DPMSolverSDEScheduler,
    DPMSolverSinglestepScheduler,
    EulerAncestralDiscreteScheduler,
    EulerDiscreteScheduler,
    HeunDiscreteScheduler,
    KDPM2AncestralDiscreteScheduler,
    KDPM2DiscreteScheduler,
    LCMScheduler,
    LMSDiscreteScheduler,
    PNDMScheduler,
    TCDScheduler,
    UniPCMultistepScheduler,
)

SCHEDULER_MAP = {
    "ddim": (DDIMScheduler, {}),
    "ddpm": (DDPMScheduler, {}),
    "deis": (DEISMultistepScheduler, {}),
    "lms": (LMSDiscreteScheduler, {"use_karras_sigmas": False}),
    "lms_k": (LMSDiscreteScheduler, {"use_karras_sigmas": True}),
    "pndm": (PNDMScheduler, {}),
    "heun": (HeunDiscreteScheduler, {"use_karras_sigmas": False}),
    "heun_k": (HeunDiscreteScheduler, {"use_karras_sigmas": True}),
    "euler": (EulerDiscreteScheduler, {"use_karras_sigmas": False}),
    "euler_k": (EulerDiscreteScheduler, {"use_karras_sigmas": True}),
    "euler_a": (EulerAncestralDiscreteScheduler, {}),
    "kdpm_2": (KDPM2DiscreteScheduler, {}),
    "kdpm_2_a": (KDPM2AncestralDiscreteScheduler, {}),
    "dpmpp_2s": (DPMSolverSinglestepScheduler, {"use_karras_sigmas": False}),
    "dpmpp_2s_k": (DPMSolverSinglestepScheduler, {"use_karras_sigmas": True}),
    "dpmpp_2m": (DPMSolverMultistepScheduler, {"use_karras_sigmas": False}),
    "dpmpp_2m_k": (DPMSolverMultistepScheduler, {"use_karras_sigmas": True}),
    "dpmpp_2m_sde": (DPMSolverMultistepScheduler, {"use_karras_sigmas": False, "algorithm_type": "sde-dpmsolver++"}),
    "dpmpp_2m_sde_k": (DPMSolverMultistepScheduler, {"use_karras_sigmas": True, "algorithm_type": "sde-dpmsolver++"}),
    "dpmpp_sde": (DPMSolverSDEScheduler, {"use_karras_sigmas": False, "noise_sampler_seed": 0}),
    "dpmpp_sde_k": (DPMSolverSDEScheduler, {"use_karras_sigmas": True, "noise_sampler_seed": 0}),
    "unipc": (UniPCMultistepScheduler, {"cpu_only": True}),
    "lcm": (LCMScheduler, {}),
    "tcd": (TCDScheduler, {}),
}


# HACK(ryand): Passing a tuple of keys to Literal works at runtime, but not at type-check time. See the docs here for
# more info: https://typing.readthedocs.io/en/latest/spec/literal.html#parameters-at-runtime. For now, we are ignoring
# this error. In the future, we should fix this type handling.
SCHEDULER_NAME_VALUES = Literal[tuple(SCHEDULER_MAP.keys())]  # type: ignore
