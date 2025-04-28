"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitter } from "@/utils/api";
import { PlusIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import useSWRMutation from "swr/mutation";

interface Inputs {
  name: string;
  url: string;
  description?: string;
}

export function TestsAddButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Inputs>();

  const { trigger } = useSWRMutation("/api/tests", submitter /** options */);

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    console.log("submitting form data", data);

    try {
      const res = await trigger(JSON.stringify(data));

      toast.success("Test created!");
      setOpen(false); // close the dialog
      reset(); // reset the form fields
      router.push(`/tests/${res.id}`); // redirect to the new test page
    } catch (error) {
      console.error("Error creating test:", error);
      toast.error("Error creating test.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-green-700 hover:bg-green-800">
          <PlusIcon className="mr-1 inline size-5" />
          Create New Test
        </Button>
      </DialogTrigger>
      <DialogContent className="">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New Test</DialogTitle>
            <DialogDescription>
              Enter information about the test you want to create.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-x-4">
              <div className="col-span-1 text-right">
                <Label htmlFor="name" className="text-right">
                  Test Name<span className="pl-0.5 text-red-500">*</span>
                </Label>
              </div>
              <div className="col-span-3">
                <Input
                  id="name"
                  className="col-span-3"
                  placeholder="Main user journey"
                  {...register("name", { required: "This field is required." })}
                />
              </div>
              <div className="col-span-4 text-right">
                {errors.name && (
                  <p className="py-1 text-sm text-red-500">{String(errors.name.message)}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-x-4">
              <div className="col-span-1 text-right">
                <Label htmlFor="name" className="text-right">
                  Base URL<span className="pl-0.5 text-red-500">*</span>
                </Label>
              </div>
              <div className="col-span-3">
                <Input
                  id="url"
                  className="col-span-3"
                  placeholder="https://google.com"
                  {...register("url", {
                    required: "This field is required.",
                    pattern: {
                      value: /^(https?:\/\/)?([\w\d-]+\.){1,}[\w]{2,}(\/.*)?$/,
                      message: "Invalid URL format",
                    },
                  })}
                />
              </div>
              <div className="col-span-4 text-right">
                {errors.url && (
                  <p className="py-1 text-sm text-red-500">{String(errors.url.message)}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-x-4">
              <div className="col-span-1 text-right">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
              </div>
              <div className="col-span-3">
                <Textarea
                  id="description"
                  className="col-span-3"
                  placeholder="Optional description here..."
                  {...register("description")}
                />
              </div>
              <div className="col-span-4 text-right">
                {errors.description && (
                  <p className="py-1 text-sm text-red-500">{String(errors.description.message)}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Test</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
