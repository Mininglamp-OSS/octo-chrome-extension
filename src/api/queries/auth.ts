import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEVICE_FLAG, getDeviceInfo } from "@/platform/device";
import { useAuthStore } from "@/stores/auth";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type LoginResponse, LoginResponseSchema, type Me, MeSchema } from "../schemas/auth";

interface LoginPayload {
  username: string;
  password: string;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationKey: ["auth", "login"],
    async mutationFn(payload: LoginPayload): Promise<LoginResponse> {
      const device = await getDeviceInfo();
      const data = await api
        .post(Endpoints.login, {
          json: {
            username: payload.username,
            password: payload.password,
            flag: DEVICE_FLAG,
            device,
          },
        })
        .json();
      return LoginResponseSchema.parse(data);
    },
    async onSuccess(data) {
      await setAuth({
        token: data.token,
        uid: data.uid,
        ...(data.name != null && { name: data.name }),
        ...(data.short_no != null && { shortNo: data.short_no }),
        ...(data.sex != null && { sex: data.sex }),
        ...(data.role != null && { role: data.role }),
        loggedIn: true,
        loggedInAt: Date.now(),
      });
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["auth", "logout"],
    async mutationFn() {
      try {
        await api.post(Endpoints.logout).json();
      } catch {
        // 即使后端登出失败也要清本地
      }
    },
    async onSuccess() {
      await clear();
      qc.clear();
    },
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["auth", "me"],
    enabled,
    async queryFn(): Promise<Me> {
      const data = await api.get(Endpoints.me).json();
      return MeSchema.parse(data);
    },
  });
}
