"""
    Created By : Elliot Francis
    Description : Sample Elixir/Phoenix Application Model Interfce from a web based RFID Inventory System
    This interface controls access to the Locations model and limited statistics reports.

    Note : This API is secure at the router level using tag based user authentication derived via JSON Web Tokens
"""
defmodule ChemistryRfid.Location do

  import Ecto.Query
  import Ecto.Changeset
  alias ChemistryRfid.Repo
  alias ChemistryRfid.LocationSchema, as: Location

  def changeset(location, params \\ %{})  do
    location
    |> cast(params, [:code, :building, :room, :address])
    |> validate_required([:code])
  end

  def tag_changeset(location, params \\ %{})  do
    location
    |> cast(params, [:tags])
  end

  def parse_tags(location) do
    tagList = case location.tags do
      nil -> []
      "" -> []
      _ -> String.split(location.tags, ",", trim: true)
    end

    { :ok, tagList }
  end

  def sanitize(location) do
    secure_fields = []
    Map.drop(location, secure_fields)
  end

  @doc """
  Fetch locations based on the given key and value

  Returns { :ok, location } or { :error, reason }
  """
  def get(key, value) do
    case key do
      :code ->
        row = Location |> Repo.get_by(code: value)
        if row == nil do
          { :error, "Location Not Found" }
        else
          { :ok, row }
        end
      :id ->
        row = Location |> Repo.get_by(id: value)
        if row == nil do
          { :error, "Location Not Found" }
        else
          { :ok, row }
        end
      _ -> { :error, "Provided key is not allowed for get actions" }
    end
  end

  # Support Function for any field searches
  defp location_search_query(key, value) do
    searchString = "%#{value}%"
    query = from l in Location, where: like(field(l, ^key), ^searchString)
    locations = case Repo.all(query) do
      nil -> []
      locations -> locations
    end
    { :ok, locations }
  end

  @doc """
  Fetch locations based on the given key and value

  Returns { :ok, [locations] } or { :error, reason }
  """
  def search(key, value) do
    case key do
      :id ->
        case get(:id, value) do
          { :ok, location } -> { :ok, [location] }
          { :error, reason } -> { :error, reason }
          _ -> {:error, "Unknown Error"}
        end
      :code -> location_search_query(:code, value)
      :name -> location_search_query(:name, value)
      _ -> {:error, "Invalid Key"}
    end
  end

  defp insert_location(data) do
    changeset(%Location{}, data) |> Repo.insert
  end

  @doc """
  Create a location based on the given data

  Returns { :ok, location } or { :error, reason }
  """
  def findOrCreate(data) do
    case get(:code, data["code"]) do
      { :ok, location } -> { :ok, location }
      { :error, "Location Not Found" } -> insert_location(data)
      { :error, reason } -> { :error, reason }
      _ -> { :error, "Unknown Error" }
    end
  end

  @doc """
  Update a location based on the given data

  Returns { :ok, location } or { :error, reason }
  """
  def update({:ok, location}, updateData) do
    changeset(location, updateData) |> Repo.update
  end

  def update({:error, reason}, _updateData) do
    { :error, reason }
  end


  @doc """
  Add a tag to the given location

  Returns { :ok, location } or { :error, reason }
  """
  def add_tag({:ok, location}, new_tag) do
    { :ok, tags } = parse_tags(location)
    new_tags = case new_tag in tags do
      true -> tags |> Enum.join(",")
      false -> List.insert_at(tags, -1, new_tag) |> Enum.join(",")
    end
    tag_changeset(location, %{ tags: new_tags }) |> Repo.update
  end

  def add_tag({:error, reason}, _new_tag) do
    { :error, reason }
  end

  @doc """
  Remove a tag from the given location

  Returns { :ok, location } or { :error, reason }
  """
  def remove_tag({:ok, location}, new_tag) do
    { :ok, tags } = parse_tags(location)
    new_tags = List.delete(tags, new_tag) |> Enum.join(",")
    tag_changeset(location, %{ tags: new_tags }) |> Repo.update
  end

  def remove_tag({:error, reason}, _new_tag) do
    { :error, reason }
  end

  # Statistics Actions

  def statistic("count") do
    query = from l in Location, select: count(l.code, :distinct)
    result = Repo.all(query)
    {:ok, Enum.at(result, 0)}
  end
end
