import api from "./api";

export const chatWithAI = async (message, history) => {
    const response = await api.post("/ai/chat", { message, history });
    return response.data;
};
