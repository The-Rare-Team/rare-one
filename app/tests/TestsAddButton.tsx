import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitter } from "@/utils/api"
import { PlusIcon } from "@heroicons/react/24/solid"
import React from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import { toast } from "react-toastify"
import useSWRMutation from 'swr/mutation'

interface Inputs {
    name: string
}

export function TestsAddButton() {

    const [open, setOpen] = React.useState(false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<Inputs>()

    const { trigger } = useSWRMutation('/api/tests', submitter, /** options */)

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        console.log("submitting form data", data);

        try {
            await trigger(JSON.stringify(data)); // use SWR to submit and revaluate the data.

            toast.success("Test created!");
            setOpen(false);
            reset(); // reset the form fields

        } catch (error) {
            console.error("Error creating test:", error);
            toast.error("Error creating test.");
        }

    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="bg-green-700 hover:bg-green-800"><PlusIcon className="size-5 inline mr-1" />Create New Test</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
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
                                    Test Name
                                </Label>
                            </div>
                            <div className="col-span-3">
                                <Input id="name" className="col-span-3" placeholder="Main user journey" {...register("name", { required: "This field is required." })} />
                            </div>
                            <div className="col-span-4 text-right">
                                {errors.name && <p className="text-red-500 py-1 text-sm">{String(errors.name.message)}</p>}
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button type="submit">Create Test</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
