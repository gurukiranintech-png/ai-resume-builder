import api from "./api";

export const getMyProfile = async () => {
    const response = await api.get("/users/profile");
    return response.data;
};

export const updateMyProfile = async ({ bio, phone }) => {
    const response = await api.put("/users/me", { bio, phone });
    return response.data;
};

export const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append("profilePicture", file);

    const response = await api.post("/users/me/picture", formData);
    return response.data;
};
