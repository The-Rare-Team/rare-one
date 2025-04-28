export const fetcher = async (url: string) => {
    const res = await fetch(url);

    if (!res.ok) {
        const error = new Error("An error occurred while fetching the data.") as Error & { info?: any; status?: number };
        error.info = await res.json();
        error.status = res.status;
        throw error;
    }

    return res.json();
};

export const submitter = async (url: string, { arg }: { arg: string }) => {
    const res = await fetch(url, {
        method: 'POST',
        body: arg,
    });

    if (!res.ok) {
        const error = new Error("An error occurred while submitting the data.") as Error & { info?: any; status?: number };
        error.info = await res.json();
        error.status = res.status;
        throw error;
    } else {

        return res.json();
    }
}