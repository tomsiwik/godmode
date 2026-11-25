"use client";
import { useStaticSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { create } from "zbsearch";

function initDB() {
  return create({
    schema: { _: "string" },
    // Match the tokenizer used by the search index in routes/api/search.ts.
    language: "english",
  });
}

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const { search, onSearchChange, isLoading, data } = useStaticSearch({
    initDB,
    locale,
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={onSearchChange}
      isLoading={isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={data?.items ?? null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
