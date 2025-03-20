import { UserWithStats } from "@/lib/types";
import DataTable from "@/components/ui/data-table";

interface UserListProps {
  users: UserWithStats[];
  isLoading?: boolean;
}

export default function UserList({ users, isLoading = false }: UserListProps) {
  const columns = [
    {
      key: "rank",
      header: "Rank",
      cell: (_: UserWithStats, index: number) => <span>{index + 1}</span>,
      className: "w-16",
    },
    {
      key: "name",
      header: "Name",
      cell: (user: UserWithStats) => (
        <span className="font-medium">{user.name}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (user: UserWithStats) => (
        <span className="text-gray-500">{user.email}</span>
      ),
    },
    {
      key: "postCount",
      header: "Posts",
      cell: (user: UserWithStats) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {user.postCount}
        </span>
      ),
      className: "text-right",
    },
  ];

  // Add index to users for rank display
  const usersWithIndex = users.map((user, index) => ({ ...user, index }));

  const emptyState = (
    <div className="text-center">
      <p className="text-gray-500 text-sm">No users found</p>
    </div>
  );

  return (
    <DataTable
      data={usersWithIndex}
      columns={columns}
      keyExtractor={(user) => user.id}
      emptyState={emptyState}
      isLoading={isLoading}
    />
  );
}
