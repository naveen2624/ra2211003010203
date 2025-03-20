import { PostWithStats } from "@/lib/types";
import DataTable from "@/components/ui/data-table";
import { formatRelativeTime, truncateText } from "@/lib/utils";

interface LatestPostsProps {
  posts: PostWithStats[];
  isLoading?: boolean;
}

export default function LatestPosts({
  posts,
  isLoading = false,
}: LatestPostsProps) {
  const columns = [
    {
      key: "title",
      header: "Title",
      cell: (post: PostWithStats) => (
        <div>
          <div className="font-medium">{post.title}</div>
          <div className="text-gray-500 text-xs mt-1">
            {truncateText(post.content, 80)}
          </div>
        </div>
      ),
    },
    {
      key: "author",
      header: "Author",
      cell: (post: PostWithStats) => <span>{post.userName || "Unknown"}</span>,
      className: "w-32",
    },
    {
      key: "comments",
      header: "Comments",
      cell: (post: PostWithStats) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {post.commentCount}
        </span>
      ),
      className: "w-24 text-center",
    },
    {
      key: "time",
      header: "Posted",
      cell: (post: PostWithStats) => (
        <span className="text-sm">{formatRelativeTime(post.timestamp)}</span>
      ),
      className: "w-32",
    },
  ];

  const emptyState = (
    <div className="text-center">
      <p className="text-gray-500 text-sm">No posts found</p>
    </div>
  );

  return (
    <DataTable
      data={posts}
      columns={columns}
      keyExtractor={(post) => post.id}
      emptyState={emptyState}
      isLoading={isLoading}
    />
  );
}
